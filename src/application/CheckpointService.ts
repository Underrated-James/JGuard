import { Checkpoint, CheckpointSession, FileSnapshot, IFileScanner } from '../core/types';
import { Hasher } from '../core/Hasher';
import { ObjectStore } from '../storage/ObjectStore';
import { MetadataStore } from '../storage/MetadataStore';
import * as path from 'path';
import * as fs from 'fs/promises';
import { BlobGarbageCollector } from './BlobGarbageCollector';

export class CheckpointService {
  private gcEnabled: boolean = true;

  constructor(
    private metadataStore: MetadataStore,
    private objectStore: ObjectStore,
    private scanner: IFileScanner,
    private workspaceRoot: string
  ) {}

  setGCEnabled(enabled: boolean) {
    this.gcEnabled = enabled;
  }

  /**
   * Generates a simple unique ID (ulid alternative)
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  /**
   * Helper to detect binary files (simple check for MVP)
   */
  private isBinary(content: Uint8Array): boolean {
    // Check first 8KB for null bytes
    const len = Math.min(content.length, 8192);
    for (let i = 0; i < len; i++) {
      if (content[i] === 0) return true;
    }
    return false;
  }

  /**
   * L1: Creates a CheckpointSession spanning all workspace folders.
   * Each folder gets its own Checkpoint, sharing the same ObjectStore.
   * 
   * @param workspaceId The unique ID of the workspace.
   * @param workspaceFolders Array of workspace folder paths. If empty/undefined, falls back to this.workspaceRoot.
   * @param onProgress Optional progress callback: (processedFiles, totalFiles) => void
   * @returns The created CheckpointSession.
   */
  async createSession(
    workspaceId: string,
    workspaceFolders?: string[],
    onProgress?: (processed: number, total: number) => void
  ): Promise<CheckpointSession> {
    const sessionId = this.generateId();
    const folderCheckpoints: Record<string, Checkpoint> = {};

    const folders = workspaceFolders && workspaceFolders.length > 0
      ? workspaceFolders
      : [this.workspaceRoot];

    for (const folderRoot of folders) {
      const cp = await this.createCheckpointForFolder(workspaceId, folderRoot, onProgress);
      folderCheckpoints[folderRoot] = cp;
    }

    const session: CheckpointSession = {
      id: sessionId,
      createdAt: Date.now(),
      folderCheckpoints,
      status: 'active',
    };

    // Save session to metadata store
    await this.metadataStore.writeSession(sessionId, session);

    // Write a lock file with session ID
    const lockFile = path.join((this.metadataStore as any).storageBaseDir, 'jguard.lock');
    await fs.writeFile(lockFile, sessionId, 'utf-8');

    // Fire and forget GC
    this.cleanOldCheckpoints().catch(console.error);

    return session;
  }

  /**
   * L1: Creates a single checkpoint for one workspace folder.
   * L4: Uses batched parallel processing for I/O throughput.
   *
   * @param workspaceId The workspace ID.
   * @param folderRoot Absolute path to the workspace folder.
   * @param onProgress Optional progress callback.
   */
  private async createCheckpointForFolder(
    workspaceId: string,
    folderRoot: string,
    onProgress?: (processed: number, total: number) => void
  ): Promise<Checkpoint> {
    const id = this.generateId();
    const files: Record<string, FileSnapshot> = {};

    const paths = await this.scanner.scan();
    const entries = [...paths.entries()];
    const totalFiles = entries.length;

    // L4: Batched parallel processing — 50 files concurrently
    const BATCH_SIZE = 50;
    let processed = 0;

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async ([relPath, meta]) => {
          const absPath = path.join(folderRoot, relPath);
          const content: Uint8Array = await fs.readFile(absPath);
          const hash = await this.objectStore.write(content, absPath);
          return { relPath, hash, meta, isBinary: this.isBinary(content) };
        })
      );

      for (const r of results) {
        files[r.relPath] = {
          hash: r.hash,
          size: r.meta.size,
          mtime: r.meta.mtime,
          isBinary: r.isBinary,
        };
      }

      processed += batch.length;
      if (onProgress) {
        onProgress(processed, totalFiles);
      }
    }

    const checkpoint: Checkpoint = {
      id,
      workspaceId,
      createdAt: Date.now(),
      status: 'active',
      files,
      workspaceRoot: folderRoot,
    };

    await this.metadataStore.write(id, checkpoint);

    return checkpoint;
  }

  /**
   * Creates a new checkpoint of the current workspace state (legacy single-root API).
   * Now delegates to createSession internally but returns a single Checkpoint for compatibility.
   *
   * @param workspaceId The unique ID of the workspace.
   * @param onProgress Optional progress callback.
   * @returns The created checkpoint.
   */
  async createCheckpoint(
    workspaceId: string,
    onProgress?: (processed: number, total: number) => void
  ): Promise<Checkpoint> {
    const id = this.generateId();
    const files: Record<string, FileSnapshot> = {};

    const paths = await this.scanner.scan();
    const entries = [...paths.entries()];
    const totalFiles = entries.length;

    // L4: Batched parallel processing — 50 files concurrently
    const BATCH_SIZE = 50;
    let processed = 0;

    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async ([relPath, meta]) => {
          const absPath = path.join(this.workspaceRoot, relPath);
          const content: Uint8Array = await fs.readFile(absPath);
          const hash = await this.objectStore.write(content);
          return { relPath, hash, meta, isBinary: this.isBinary(content) };
        })
      );

      for (const r of results) {
        files[r.relPath] = {
          hash: r.hash,
          size: r.meta.size,
          mtime: r.meta.mtime,
          isBinary: r.isBinary,
        };
      }

      processed += batch.length;
      if (onProgress) {
        onProgress(processed, totalFiles);
      }
    }

    const checkpoint: Checkpoint = {
      id,
      workspaceId,
      createdAt: Date.now(),
      status: 'active',
      files,
      workspaceRoot: this.workspaceRoot,
    };

    await this.metadataStore.write(id, checkpoint);

    // Also write a lock file
    const lockFile = path.join((this.metadataStore as any).storageBaseDir, 'jguard.lock');
    await fs.writeFile(lockFile, id, 'utf-8');

    // Fire and forget GC
    this.cleanOldCheckpoints().catch(console.error);

    return checkpoint;
  }

  /**
   * L7: Updates an existing checkpoint in the metadata store.
   */
  async updateCheckpoint(checkpoint: Checkpoint): Promise<void> {
    await this.metadataStore.write(checkpoint.id, checkpoint);
  }

  /**
   * L7: Updates an existing session in the metadata store.
   */
  async updateSession(session: CheckpointSession): Promise<void> {
    await this.metadataStore.writeSession(session.id, session);
  }

  /**
   * Reads a checkpoint by ID from the metadata store.
   */
  async readCheckpoint(id: string): Promise<Checkpoint> {
    return this.metadataStore.read(id);
  }

  /**
   * Cleans up old checkpoints, keeping only the most recent ones.
   * L7: Respects grace period — doesn't GC recently finalized checkpoints.
   */
  async cleanOldCheckpoints(keepCount: number = 3): Promise<void> {
    const GRACE_PERIOD = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();
    const checkpointsDir = (this.metadataStore as any).getCheckpointsDir();
    try {
      const dirFiles = await fs.readdir(checkpointsDir);
      const cpFiles = dirFiles.filter((f: string) => f.endsWith('.json'));
      
      const checkpoints: {id: string, createdAt: number, status: string, finalizedAt?: number}[] = [];
      for (const f of cpFiles) {
        const id = f.replace('.json', '');
        const cp = await this.metadataStore.read(id);
        checkpoints.push({ id, createdAt: cp.createdAt, status: cp.status, finalizedAt: cp.finalizedAt });
      }

      // Sort descending (newest first)
      checkpoints.sort((a, b) => b.createdAt - a.createdAt);

      // Filter out active checkpoints and grace-period-protected checkpoints
      const deletable = checkpoints.filter(cp => {
        if (cp.status === 'active') {
          return false; // Active checkpoints must never be deleted
        }
        if (cp.finalizedAt && (now - cp.finalizedAt) < GRACE_PERIOD) {
          return false; // Protected by grace period
        }
        return true;
      });

      // Delete anything beyond keepCount from the deletable list
      for (let i = keepCount; i < deletable.length; i++) {
        await this.metadataStore.delete(deletable[i].id);
        // Also delete session if there is one
        await this.metadataStore.deleteSession(deletable[i].id);
      }
      
      // L4: Run BlobGarbageCollector
      if (this.gcEnabled) {
        const storageBaseDir = (this.metadataStore as any).storageBaseDir;
        const gc = new BlobGarbageCollector(this.metadataStore, this.objectStore, storageBaseDir);
        const { deletedCount, bytesFreed } = await gc.run();
        if (deletedCount > 0) {
          console.log(`JGuard GC: Deleted ${deletedCount} orphaned blobs, freed ${(bytesFreed / 1024 / 1024).toFixed(2)} MB`);
        }
      }
      
    } catch (e) {
      // Ignore errors during GC
      console.error('GC error', e);
    }
  }

  /**
   * Manually clears old finalized sessions from history, keeping only the 3 most recent ones.
   */
  async clearOldHistory(keepCount: number = 3): Promise<void> {
    const checkpointsDir = (this.metadataStore as any).getCheckpointsDir();
    try {
      const dirFiles = await fs.readdir(checkpointsDir);
      const cpFiles = dirFiles.filter((f: string) => f.endsWith('.json'));
      
      const checkpoints: {id: string, createdAt: number, status: string}[] = [];
      for (const f of cpFiles) {
        const id = f.replace('.json', '');
        const cp = await this.metadataStore.read(id);
        checkpoints.push({ id, createdAt: cp.createdAt, status: cp.status });
      }

      // Sort descending (newest first)
      checkpoints.sort((a, b) => b.createdAt - a.createdAt);

      const finalized = checkpoints.filter(cp => cp.status !== 'active');
      
      let deletedCount = 0;
      // Delete anything beyond keepCount
      for (let i = keepCount; i < finalized.length; i++) {
        await this.metadataStore.delete(finalized[i].id);
        await this.metadataStore.deleteSession(finalized[i].id);
        deletedCount++;
      }
      
      // Run Garbage Collector immediately to free up disk space
      if (this.gcEnabled && deletedCount > 0) {
        const storageBaseDir = (this.metadataStore as any).storageBaseDir;
        const gc = new BlobGarbageCollector(this.metadataStore, this.objectStore, storageBaseDir);
        const gcResult = await gc.run();
        console.log(`JGuard Manual GC: Deleted ${gcResult.deletedCount} orphaned blobs, freed ${(gcResult.bytesFreed / 1024 / 1024).toFixed(2)} MB`);
      }
    } catch (e) {
      console.error('Failed to clear history', e);
      throw e;
    }
  }

  /**
   * Deletes a specific finalized session from history.
   */
  async deleteHistorySession(sessionId: string): Promise<void> {
    try {
      const cp = await this.metadataStore.readSession(sessionId);

      await this.metadataStore.delete(sessionId);
      await this.metadataStore.deleteSession(sessionId);

      // Run Garbage Collector immediately
      if (this.gcEnabled) {
        const storageBaseDir = (this.metadataStore as any).storageBaseDir;
        const gc = new BlobGarbageCollector(this.metadataStore, this.objectStore, storageBaseDir);
        const gcResult = await gc.run();
        console.log(`JGuard: Deleted specific session ${sessionId}. GC freed ${(gcResult.bytesFreed / 1024 / 1024).toFixed(2)} MB`);
      }
    } catch (e) {
      console.error(`Failed to delete session ${sessionId}`, e);
      throw e;
    }
  }
}
