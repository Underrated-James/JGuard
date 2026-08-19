import * as fs from 'fs/promises';
import * as path from 'path';
import { Checkpoint } from '../core/types';

export class MetadataStore {
  constructor(private storageBaseDir: string) {}

  private getCheckpointsDir(): string {
    return path.join(this.storageBaseDir, 'checkpoints');
  }

  private getCheckpointPath(id: string): string {
    return path.join(this.getCheckpointsDir(), `${id}.json`);
  }

  /**
   * Initializes the checkpoints directory structure.
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.getCheckpointsDir(), { recursive: true });
  }

  /**
   * Writes a checkpoint to disk atomically.
   * @param id The checkpoint ID.
   * @param checkpoint The checkpoint data.
   */
  async write(id: string, checkpoint: Checkpoint): Promise<void> {
    const cpPath = this.getCheckpointPath(id);
    const tmpPath = `${cpPath}.tmp.${Date.now()}`;

    await fs.writeFile(tmpPath, JSON.stringify(checkpoint, null, 2), 'utf-8');
    await fs.rename(tmpPath, cpPath);
  }

  /**
   * Reads a checkpoint from disk.
   * @param id The checkpoint ID.
   * @returns The checkpoint data.
   */
  async read(id: string): Promise<Checkpoint> {
    const cpPath = this.getCheckpointPath(id);
    const content = await fs.readFile(cpPath, 'utf-8');
    return JSON.parse(content) as Checkpoint;
  }

  /**
   * Deletes a checkpoint from disk.
   * @param id The checkpoint ID.
   */
  async delete(id: string): Promise<void> {
    const cpPath = this.getCheckpointPath(id);
    try {
      await fs.unlink(cpPath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }
}
