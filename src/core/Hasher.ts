import * as crypto from 'crypto';
import * as fs from 'fs';

export class Hasher {
  /**
   * Computes the SHA-256 hash of a file using streams to handle large files efficiently.
   * @param absolutePath The absolute path to the file.
   * @returns A promise that resolves to the hex representation of the SHA-256 hash.
   */
  static hashFile(absolutePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(absolutePath);

      stream.on('data', (chunk) => {
        hash.update(chunk);
      });

      stream.on('end', () => {
        resolve(hash.digest('hex'));
      });

      stream.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Computes the SHA-256 hash of a buffer.
   * @param content The buffer to hash.
   * @returns The hex representation of the SHA-256 hash.
   */
  static hashBuffer(content: Uint8Array): string {
    const hash = crypto.createHash('sha256');
    hash.update(content);
    return hash.digest('hex');
  }
}
