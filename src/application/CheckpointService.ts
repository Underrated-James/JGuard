import { Checkpoint, FileSnapshot, IFileScanner } from '../core/types';
import { Hasher } from '../core/Hasher';
import { ObjectStore } from '../storage/ObjectStore';
import { MetadataStore } from '../storage/MetadataStore';
import * as path from 'path';

export class CheckpointService {
  constructor(
    private metadataStore: MetadataStore,
    private objectStore: ObjectStore,
    private scanner: IFileScanner,
    private workspaceRoot: string
  ) {}

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
   * Creates a new checkpoint of the current workspace state.
   * @param workspaceId The unique ID of the workspace.
   * @returns The created checkpoint.
   */
  async createCheckpoint(workspaceId: string): Promise<Checkpoint> {
    const id = this.generateId();
    const files: Record<string, FileSnapshot> = {};

    const paths = await this.scanner.scan();

    for (const [relPath, meta] of paths.entries()) {
      const absPath = path.join(this.workspaceRoot, relPath);
      
      // We read the file to hash it and store it
      // Using fs directly here since we need the buffer for the ObjectStore
      const fs = require('fs/promises');
      const content: Uint8Array = await fs.readFile(absPath);
      
      const hash = await this.objectStore.write(content);
      
      files[relPath] = {
        hash,
        size: meta.size,
        mtime: meta.mtime,
        isBinary: this.isBinary(content),
      };
    }

    const checkpoint: Checkpoint = {
      id,
      workspaceId,
      createdAt: Date.now(),
      status: 'active',
      files,
    };

    await this.metadataStore.write(id, checkpoint);

    // Also write a lock file
    const lockFile = path.join((this.metadataStore as any).storageBaseDir, 'jguard.lock');
    const fs2 = require('fs/promises');
    await fs2.writeFile(lockFile, id, 'utf-8');

    // Fire and forget GC
    this.cleanOldCheckpoints().catch(console.error);

    return checkpoint;
  }

  /**
   * Cleans up old checkpoints, keeping only the most recent ones.
   */
  async cleanOldCheckpoints(keepCount: number = 3): Promise<void> {
    const fs = require('fs/promises');
    const checkpointsDir = (this.metadataStore as any).getCheckpointsDir();
    try {
      const files = await fs.readdir(checkpointsDir);
      const cpFiles = files.filter((f: string) => f.endsWith('.json'));
      
      const checkpoints: {id: string, createdAt: number}[] = [];
      for (const f of cpFiles) {
        const id = f.replace('.json', '');
        const cp = await this.metadataStore.read(id);
        checkpoints.push({ id, createdAt: cp.createdAt });
      }

      // Sort descending (newest first)
      checkpoints.sort((a, b) => b.createdAt - a.createdAt);

      // Delete anything beyond keepCount
      for (let i = keepCount; i < checkpoints.length; i++) {
        await this.metadataStore.delete(checkpoints[i].id);
      }
    } catch (e) {
      // Ignore errors during GC
    }
  }
}
