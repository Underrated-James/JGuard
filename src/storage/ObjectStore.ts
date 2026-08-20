import * as fs from 'fs/promises';
import * as path from 'path';
import { Hasher } from '../core/Hasher';
import { ContentNormalizer } from '../core/ContentNormalizer';

export class ObjectStore {
  constructor(private storageBaseDir: string) {}

  private getObjectDir(hash: string): string {
    return path.join(this.storageBaseDir, 'objects', hash.substring(0, 2));
  }

  private getObjectPath(hash: string): string {
    return path.join(this.getObjectDir(hash), hash);
  }

  /**
   * Initializes the object store directory structure.
   */
  async initialize(): Promise<void> {
    const objectsDir = path.join(this.storageBaseDir, 'objects');
    await fs.mkdir(objectsDir, { recursive: true });
  }

  /**
   * Writes content to the object store if it doesn't already exist.
   * L7: Normalizes text files to LF to avoid cross-OS discrepancies.
   * @param content The content to write.
   * @param filePath Optional filepath to determine if it's text.
   * @returns The SHA-256 hash of the content.
   */
  async write(content: Uint8Array, filePath?: string): Promise<string> {
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const finalContent = filePath ? ContentNormalizer.normalize(buffer, filePath) : buffer;
    
    const hash = Hasher.hashBuffer(finalContent); // The buffer is already normalized here
    const objPath = this.getObjectPath(hash);
    const objDir = this.getObjectDir(hash);

    try {
      await fs.stat(objPath);
      // Object already exists, no need to write
      return hash;
    } catch {
      // Object doesn't exist, proceed to write
    }

    await fs.mkdir(objDir, { recursive: true });
    
    // Write atomically using a temporary file
    const tmpPath = `${objPath}.tmp.${Date.now()}`;
    await fs.writeFile(tmpPath, finalContent);
    await fs.rename(tmpPath, objPath);

    return hash;
  }

  /**
   * Reads content from the object store.
   * @param hash The SHA-256 hash of the object.
   * @returns The content buffer.
   */
  async read(hash: string): Promise<Uint8Array> {
    const objPath = this.getObjectPath(hash);
    return await fs.readFile(objPath);
  }

  /**
   * Checks if an object exists in the store.
   * @param hash The SHA-256 hash of the object.
   */
  async exists(hash: string): Promise<boolean> {
    const objPath = this.getObjectPath(hash);
    try {
      await fs.stat(objPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Deletes an object from the store.
   * @param hash The SHA-256 hash of the object.
   */
  async delete(hash: string): Promise<void> {
    const objPath = this.getObjectPath(hash);
    try {
      await fs.unlink(objPath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }
}
